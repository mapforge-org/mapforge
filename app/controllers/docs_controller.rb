class DocsController < ApplicationController
  def tutorials
  end

  def tutorial
    tutorial = Tutorial.find(params[:id])
    respond_to do |format|
      format.html do
        @title = tutorial.title
        @html_content = tutorial.to_html
      end
      format.md { render markdown: tutorial.markdown }
    end
  end
end
