class FrontpageController < ApplicationController
  layout "frontpage"

  def index
    redirect_to my_path if @user
  end

  def home
    render :index
  end
end
