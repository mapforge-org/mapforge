class Tutorial
  attr_accessor :name, :markdown, :html_content

  def initialize(name, markdown)
    @name = name
    @markdown = markdown
  end

  def self.find(id)
    safe_id = File.basename(id.to_s)               # removes any path components
    safe_id = safe_id.sub(/\A\/*/, "")
    file_path = Rails.root.join("docs", "tutorials", "#{safe_id}.md")
    if File.exist?(file_path)
      self.new(safe_id, File.read(file_path))
    else
      raise ActionController::RoutingError, "Tutorial not found"
    end
  end

  def title
    headline = markdown.lines.find { |line| line.strip.match?(/^#+\s/) }
    headline.gsub("#", "")&.strip
  end

  def to_html
    renderer = Redcarpet::Render::HTML.new(
      filter_html: false,
      hard_wrap: true
    )
    markdown_parser = Redcarpet::Markdown.new(renderer, tables: true)
    markdown_parser.render(markdown).html_safe
  end
end
