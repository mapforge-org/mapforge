class AdminController < ApplicationController
  before_action :require_admin_user

  def index
    @sort = params[:sort] || "updated_at"
    @direction = params[:direction] || "desc"
    @search = params[:search].to_s.strip

    @maps = Map.unscoped.includes(:layers, :user)
    @maps = @maps.search(@search) unless @search.empty?
    @maps = @maps.sorted(@sort, @direction)
    @maps = @maps.limit(params[:limit] || 300)

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
