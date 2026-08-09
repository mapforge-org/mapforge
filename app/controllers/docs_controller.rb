class DocsController < ApplicationController
  def tutorials
  end

  def tutorial
    tutorial_id = params.permit(:id)[:id].to_s
    raise ActionController::RoutingError, "Tutorial not found" unless tutorial_id.match?(/\A[\w-]+\z/)
    tutorial = Tutorial.find(tutorial_id)
    respond_to do |format|
      format.html do
        @title = tutorial.title
        @html_content = tutorial.to_html
      end
      format.md { render markdown: tutorial.markdown }
    end
  end
end
