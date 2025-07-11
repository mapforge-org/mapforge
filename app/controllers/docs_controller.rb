class DocsController < ApplicationController
  def tutorials
  end

  def tutorial
    id = params[:id]
    safe_id = File.basename(id.to_s)               # removes any path components
    safe_id = safe_id.sub(/\A\/*/, "")
    file_path = Rails.root.join("docs", "tutorials", "#{safe_id}.md")
    if File.exist?(file_path)
      markdown_text = File.read(file_path)
      renderer = Redcarpet::Render::HTML.new(
        filter_html: true,
        hard_wrap: true
      )
      markdown = Redcarpet::Markdown.new(renderer, extensions = {})
      @html_content = markdown.render(markdown_text).html_safe
    else
      render plain: "Page not found", status: :not_found
    end
  end
end
