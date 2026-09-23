module MapListFilters
  extend ActiveSupport::Concern

  SORT_COLUMNS = %w[created_at updated_at view_count].freeze

  def filter_and_sort_maps(maps, default_sort: "updated_at")
    @sort = SORT_COLUMNS.include?(params[:sort]) ? params[:sort] : default_sort
    @direction = params[:direction] || "desc"
    @search = @filter = params[:search].to_s.strip
    if @search.include? "user:"
      @filter = @search.sub(/\buser:(\S+)\s*/, "").strip
      userid = $1
      @searchuser = User.find(userid) if userid.present?
    end

    if @searchuser
      # Find maps where user is in owner_ids array
      maps = maps.where(owner_ids: @searchuser.id)
    end
    maps = maps.search(@filter) unless @filter.empty?
    maps = maps.sorted(@sort, @direction)
    maps.limit(300)
  end
end
