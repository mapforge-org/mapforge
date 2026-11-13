class AdminController < ApplicationController
  include MapListFilters

  before_action :require_admin_user

  def index
    @quick = params[:quick]
    @maps = filter_and_sort_maps(quick_filter(Map.includes(:layers, :owners)))

    respond_to do |format|
      format.html # full page
      format.turbo_stream # for partial updates via Turbo/Stimulus
    end
  end

  private

  def quick_filter(maps)
    case @quick
    when "featured" then maps.where(tags: "featured")
    when "public" then maps.listed
    when "content" then maps.in(id: Layer.where(:features_count.gt => 0).distinct(:map_id))
    else maps
    end
  end

  def require_admin_user
    redirect_to login_path unless @user&.admin?
  end
end
