class AdminController < ApplicationController
  include MapListFilters

  QUICK_FILTERS = { "all" => "All", "featured" => "Featured", "public" => "Public", "content" => "With content" }.freeze

  before_action :require_admin_user

  def index
    @quick = QUICK_FILTERS.key?(params[:quick]) ? params[:quick] : "content"
    @maps = sort_maps(quick_filter(search_maps(Map.includes(:layers, :owners)), @quick))

    respond_to do |format|
      # The counts ignore the search, so only the full page needs them
      format.html { @quick_counts = QUICK_FILTERS.keys.index_with { |key| quick_filter(Map.all, key).count } }
      format.turbo_stream # for partial updates via Turbo/Stimulus
    end
  end

  private

  def quick_filter(maps, key)
    case key
    when "featured" then maps.featured
    when "public" then maps.listed
    when "content" then maps.in(id: @content_map_ids ||= Layer.where(:features_count.gt => 0).distinct(:map_id))
    else maps
    end
  end

  def require_admin_user
    redirect_to login_path unless @user&.admin?
  end
end
