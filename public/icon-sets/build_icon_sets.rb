#!/usr/bin/env ruby
# Builds the icon sets under public/icon-sets from their npm packages.
#
# MapLibre cannot load an SVG into 'icon-image', so every icon is rasterized to a PNG of the
# same size as the emojis in public/icon-sets/noto. The output is committed, this script only
# runs when a set gets added or updated. See public/icon-sets/README.
#
# Usage: ruby public/icon-sets/build_icon_sets.rb [set ...]   (default: all sets)

require "fileutils"
require "json"
require "tmpdir"

SIZE = 72

# The icons that Mapforge makes itself, so that they stay apart from the downloaded sets
OWN_SET = "mapforge"

EMOJI_DATA = "public/icon-sets/noto/emoji-mart-data.json"

SETS = {
  "pinhead" => {
    package: "@waysidemapping/pinhead",
    name: "Pinhead",
    icon: "map_pin_with_dot",
    dir: "dist/icons",
    # changelog.json names the icon of every source set that a pinhead icon replaces, and
    # those names become extra search keywords, see aliases
    aliases: "dist/changelog.json",
    sources: "dist/external_sources.json",
    # a marker-symbol 'cafe' loads pinhead/cafe.png, a link to the icon that replaced maki 'cafe'
    links: "maki",
    # pinhead draws 0 to 12, the rest gets composed from its digits into OWN_SET and linked
    # from pinhead/, see compose_numbers
    numbers: 13..50
  },
  "fontawesome" => {
    package: "@fortawesome/fontawesome-free",
    name: "Font Awesome",
    icon: "location-dot",
    # the free package also has regular (thin) and brands (colored logos) styles, see README
    dir: "svgs/solid"
  },
  # the pngs of an emoji set are downloaded by hand, only its index gets built
  "openmoji" => {
    name: "OpenMoji",
    icon: "🗺",
    emoji_data: true
  }
}

def run(*command)
  system(*command, exception: true)
end

def download(package, dir)
  run("npm", "pack", "--silent", "--pack-destination", dir, package)
  tarball = Dir.glob(File.join(dir, "*.tgz")).first
  run("tar", "xzf", tarball, "-C", dir)
  File.join(dir, "package")
end

# 'alcohol-shop' and 'alcohol_shop' both become 'Alcohol shop' with the keywords of both parts
def humanize(id)
  id.tr("-_", " ").capitalize
end

def rasterize(source, target)
  FileUtils.mkdir_p(target)
  svgs = Dir.glob(File.join(source, "*.svg"))
  raise "no icons in #{source}" if svgs.empty?

  # One inkscape run for all icons: the startup of the process costs more than the export.
  # --export-type writes the png next to its svg, so the svgs are copied over and removed after.
  FileUtils.cp(svgs, target)
  run("inkscape", "--export-type=png", "--export-width=#{SIZE}", "--export-height=#{SIZE}",
      *Dir.glob(File.join(target, "*.svg")))
  FileUtils.rm(Dir.glob(File.join(target, "*.svg")))
  # The sets are monochrome black. A marker draws them on a circle in the color of the
  # feature, where white reads better, so only the alpha channel of the icon is kept.
  run("magick", "mogrify", "-channel", "RGB", "-evaluate", "set", "100%",
      *Dir.glob(File.join(target, "*.png")))
  svgs.map { |svg| File.basename(svg, ".svg") }
end

# Two digits side by side in the 15 unit box of a pinhead icon. Pinhead draws narrow forms of
# 0, 1 and 2 for its own 10 to 12, the other digits get narrowed. That makes their vertical
# strokes thinner than the 3 units of pinhead, so an outline in the same color gives half of the
# loss back: the full width would close the holes of digits like 8. The digits are paths of
# absolute M, L, C and Z commands, so the numbers of a path come in x y pairs.
NUMBER_GAP = 1
DIGIT_STROKE = 3
SVG_NUMBER = /-?\d*\.?\d+/

def compose_numbers(source, numbers, target)
  own = File.join(File.dirname(target), OWN_SET)
  narrow = narrow_digits(source)
  Dir.mktmpdir("icon-set-#{OWN_SET}") do |dir|
    numbers.reject { |number| File.exist?(File.join(source, "#{number}.svg")) }.each do |number|
      File.write(File.join(dir, "#{number}.svg"), number_svg(source, number, narrow))
    end
    FileUtils.mkdir_p(own)
    FileUtils.rm(Dir.glob(File.join(own, "*.png")))
    ids = rasterize(dir, own)
    ids.each { |id| FileUtils.ln_sf("../#{OWN_SET}/#{id}.png", File.join(target, "#{id}.png")) }
    ids
  end
end

def svg_subpaths(file)
  File.read(file)[/ d="([^"]+)"/, 1].scan(/M[^M]*/)
end

def x_span(paths)
  paths.flat_map { |path| path.scan(SVG_NUMBER).map(&:to_f).each_slice(2).map(&:first) }.minmax
end

# The digits of the two digit icons of pinhead, like the narrow 1 and 0 of '10'. The subpaths of
# one digit overlap in x, the outline of a 0 and its hole.
def narrow_digits(source)
  Dir.glob(File.join(source, "[1-9][0-9].svg")).each_with_object({}) do |file, narrow|
    groups = []
    svg_subpaths(file).sort_by { |path| x_span([ path ]).first }.each do |path|
      if groups.any? && x_span([ path ]).first < x_span(groups.last).last then groups.last << path else groups << [ path ] end
    end
    digits = File.basename(file, ".svg").chars
    digits.zip(groups).each { |digit, paths| narrow[digit] ||= paths } if groups.size == digits.size
  end
end

def number_svg(source, number, narrow)
  glyphs = number.to_s.chars.map { |digit| narrow[digit] || svg_subpaths(File.join(source, "#{digit}.svg")) }
  spans = glyphs.map { |paths| x_span(paths) }
  width = spans.sum { |min, max| max - min }
  gaps = NUMBER_GAP * (glyphs.size - 1)
  outline = DIGIT_STROKE * (1 - [ (15.0 - gaps) / width, 1 ].min) / 2
  scale = [ (15.0 - gaps - outline * glyphs.size) / width, 1 ].min
  yscale = (15.0 - outline) / 15
  x = (15 - width * scale - outline * glyphs.size - gaps) / 2 + outline / 2
  paths = glyphs.zip(spans).map do |subpaths, (min, max)|
    d = subpaths.join.gsub(/(#{SVG_NUMBER})\s*(#{SVG_NUMBER})/) do
      "#{($1.to_f * scale + x - min * scale).round(3)} #{($2.to_f * yscale + outline / 2).round(3)}"
    end
    x += (max - min) * scale + outline + NUMBER_GAP
    %(<path d="#{d}" stroke="#000" stroke-width="#{outline.round(3)}"/>)
  end
  %(<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 15 15">#{paths.join}</svg>)
end

# The numbers go first and in their order, 2 before 10
def picker_order(id)
  id.match?(/\A\d+\z/) ? [ 0, id.to_i, "" ] : [ 1, 0, id ]
end

# The shape of one entry of the 'custom' option of emoji-mart. The id must be unique across the
# whole picker, so it carries the name of the set.
def index(set, config, ids, keywords)
  {
    id: set,
    name: config[:name],
    icon: { src: "/icon-sets/#{set}/#{config[:icon]}.png" },
    emojis: ids.sort_by { |id| picker_order(id) }.map do |id|
      {
        id: "#{set}-#{id}",
        name: humanize(id),
        keywords: (id.split(/[-_]/) + keywords.fetch(id, [])).uniq,
        skins: [ { src: "/icon-sets/#{set}/#{id}.png" } ]
      }
    end
  }
end

# Pinhead redrew the icons of maki, temaki and eleven more sets, and it renamed most of them:
# maki 'cafe' is pinhead 'handled_teacup_and_saucer'. changelog.json records the source name per icon,
# and those are the names our users know, so they become search keywords. A later release can
# rename an icon, which it records as oldId and newId, so the chain is followed to the id that
# still exists. The old id becomes a keyword too: a search for 'five' finds '5'.
def aliases(package, config, ids)
  sources = JSON.parse(File.read(File.join(package, config[:sources]))).map { |s| s["id"] }
  replacements(package, config, ids).each_with_object({}) do |(id, change), keywords|
    # a source name can be an OSM tag, 'tourism/hostel' gives the keywords 'tourism' and 'hostel'
    names = (sources + [ "oldId" ]).flat_map { |key| Array(change[key]) }.grep(String)
    (keywords[id] ||= []).concat(names.flat_map { |name| name.split(%r{[-_/]}) })
  end
end

# Pairs of a pinhead id and the changelog entry of the source icon that it replaced
def replacements(package, config, ids)
  changes = JSON.parse(File.read(File.join(package, config[:aliases])))
    .flat_map { |release| release["iconChanges"] }
  renamed = changes.filter_map { |c| [ c["oldId"], c["newId"] ] if c["oldId"] && c["newId"] }.to_h
  known = ids.to_set
  changes.filter_map { |change| (id = resolve(change["newId"], renamed, known)) && [ id, change ] }
end

# One relative link per name of the source set, and per id that a release renamed, so that a
# saved path like pinhead/five.png keeps its icon ('5' now). A pinhead icon of the same name
# keeps its own file: maki 'bus' links to 'bus_with_destination_display', but pinhead has a
# 'bus' icon too.
def link_names(package, config, ids, target)
  known = ids.to_set
  replacements(package, config, ids).each do |id, change|
    names = Array(change[config[:links]]) + Array(change["oldId"])
    names.grep(String).reject { |name| known.include?(name) }.each do |name|
      FileUtils.ln_sf("#{id}.png", File.join(target, "#{name}.png"))
    end
  end
end

def resolve(id, renamed, known)
  seen = Set.new
  while id && !known.include?(id) && renamed.key?(id) && seen.add?(id)
    id = renamed[id]
  end
  id if known.include?(id)
end

# An emoji set brings one png per emoji, named after the emoji character (see
# convert_to_emoji_names.sh). The name without the variation selector FE0F comes first,
# because a marker-symbol carries no FE0F either.
def emoji_file(target, native)
  [ native.delete("\uFE0F"), native ]
    .map { |name| "#{name}.png" }
    .find { |file| File.exist?(File.join(target, file)) }
end

# The index of an emoji set, built from the names and keywords of the emoji data
def emoji_index(set, config, target, root)
  data = JSON.parse(File.read(File.join(root, EMOJI_DATA)))
  emojis = data["emojis"].values.filter_map do |emoji|
    file = emoji_file(target, emoji["skins"].first["native"]) or next
    {
      id: "#{set}-#{emoji["id"]}",
      name: emoji["name"],
      keywords: emoji["keywords"],
      skins: [ { src: "/icon-sets/#{set}/#{file}" } ]
    }
  end
  { id: set, name: config[:name], icon: { src: "/icon-sets/#{set}/#{config[:icon]}.png" }, emojis: emojis }
end

def build(set, config, root)
  target = File.join(root, "public", "icon-sets", set)
  if config[:emoji_data]
    index = emoji_index(set, config, target, root)
    File.write(File.join(target, "index.json"), JSON.generate(index))
    return puts "#{set}: #{index[:emojis].size} icons"
  end

  Dir.mktmpdir("icon-set-#{set}") do |tmp|
    package = download(config[:package], tmp)
    source = File.join(package, config[:dir] || "icons")
    # A removed icon must not stay behind, and inkscape would write a new icon through an old
    # link of the same name, onto another icon
    FileUtils.rm(Dir.glob(File.join(target, "*.png")))
    ids = rasterize(source, target)
    ids += compose_numbers(source, config[:numbers], target) if config[:numbers]
    keywords = config[:aliases] ? aliases(package, config, ids) : {}
    link_names(package, config, ids, target) if config[:links]
    File.write(File.join(target, "index.json"), JSON.generate(index(set, config, ids, keywords)))
    puts "#{set}: #{ids.size} icons"
  end
end

if __FILE__ == $PROGRAM_NAME
  root = File.expand_path("../..", __dir__)
  sets = ARGV.empty? ? SETS.keys : ARGV
  sets.each do |set|
    config = SETS[set] or abort("unknown icon set '#{set}', known: #{SETS.keys.join(", ")}")
    build(set, config, root)
  end
end
