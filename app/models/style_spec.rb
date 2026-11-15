# Property data for the styling docs page, parsed from the bullets of the style spec markdown
class StyleSpec
  GEOMETRY_HEADING = /\A#### \*(\w+)\* geometr/
  PROPERTY_BULLET = /\A\* `([a-z-]+)`: (.*)/
  VALUE = /\A[a-z#][\w#.-]*\z/i
  # Values for the properties that have no default and no value list in the markdown
  EXAMPLES = { "label" => "Stadtpark", "label-title" => "Park", "label-font" => [ "SUSE" ], "label-offset" => [ 0, 1 ],
               "min-zoom" => 10, "max-zoom" => 17, "level" => "0", "title" => "Stadtpark", "desc" => "Open **9 to 17**",
               "onclick-target" => "https://mapforge.org", "marker-symbol" => "☕", "flat" => true, "marker-rotate" => 45,
               "stroke-image-url" => "/icons/direction-arrow.png", "stroke-symbol" => "➤", "fill-extrusion-height" => 30,
               "fill-extrusion-width" => 4, "fill-extrusion-shadow" => true,
               "marker-image-url" => "/logo/mapforge-logo-icon.png", "fill-image-url" => "/logo/mapforge-logo-icon.png" }.freeze

  def self.properties
    new(Tutorial.find("geojson_style_spec").markdown).properties
  end

  def initialize(markdown)
    @markdown = markdown
  end

  def properties
    entries = {}
    geometry = nil
    @markdown.each_line do |line|
      break if line.start_with?("### Label fonts")
      if (heading = line[GEOMETRY_HEADING, 1])
        geometry = heading
        next
      end
      next unless geometry && (match = line.match(PROPERTY_BULLET))

      name, text = match.captures
      entry = entries[name] ||= { name: name, group: group(name), geometries: {}, values: [] }
      entry[:geometries][geometry] = { html: Tutorial.render(text, inline: true), default: default(text) }
      entry[:values] |= text.scan(/`([^`]+)`/).flatten.grep(VALUE)
    end
    entries.each_value { |entry| clean(entry, entries.keys) }
    entries.values
  end

  private

  def clean(entry, names)
    entry[:values] -= names
    entry[:geometries].each_value { |geometry| geometry[:default] = nil if names.include?(geometry[:default]) }
    defaults = entry[:geometries].values.pluck(:default)
    entry[:values] = %w[true false] if entry[:values].empty? && defaults.intersect?(%w[true false])
    entry[:example] = EXAMPLES.fetch(entry[:name]) { typed(defaults.compact.first || entry[:values].first) }
  end

  def typed(value)
    case value
    when "true", "false" then value == "true"
    when /\A-?\d+\z/ then value.to_i
    when /\A-?\d*\.\d+\z/ then value.to_f
    else value
    end
  end

  # A default that is a sentence ("depends on marker size") has no single value, so it gets none
  def default(text)
    value = text[/([^\s,(]+) \(default\)/, 1] || text[/\(defaults?(?: to)?:?\s+([^\s,)]+)\s*[,)]/, 1] ||
      text[/The default is (\S+?)\.?(?:\s|\z)/, 1]
    value&.delete("`\"'")&.strip
  end

  def group(name)
    case name
    when /\Alabel/ then "Label"
    when /\Amarker-/, "flat" then "Marker"
    when /\Astroke/ then "Stroke"
    when /\Afill-extrusion-/ then "Extrusion"
    when /\Afill-/, "fill" then "Fill"
    when "min-zoom", "max-zoom", "level", "sort-key" then "Visibility"
    else "Content"
    end
  end
end
