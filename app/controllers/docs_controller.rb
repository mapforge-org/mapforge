class DocsController < ApplicationController
  def tutorials
  end

  def tutorial
    tutorial = Tutorial.find(params[:id])
    @title = tutorial.title
    @html_content = tutorial.to_html
  end
end
