class AdminController < ApplicationController
  include MapListFilters

  before_action :require_admin_user

  def index
    @maps = filter_and_sort_maps(Map.unscoped.includes(:layers, :user))

    respond_to do |format|
      format.html # full page
      format.turbo_stream # for partial updates via Turbo/Stimulus
    end
  end

  private

  def require_admin_user
    redirect_to login_path unless @user&.admin?
  end
end
