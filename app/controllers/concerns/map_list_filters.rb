module MapListFilters
  extend ActiveSupport::Concern

  def filter_and_sort_maps(maps)
    @sort = params[:sort] || "updated_at"
    @direction = params[:direction] || "desc"
    @search = @filter =params[:search].to_s.strip
    if @search.include? "user:"
      @filter = @search.sub(/\buser:(\S+)\s*/, "").strip
      userid = $1
      @searchuser = User.find(userid) if userid.present?
    end

    maps = maps.where(user: @searchuser) if @searchuser
    maps = maps.search(@filter) unless @filter.empty?
    maps = maps.sorted(@sort, @direction)
    maps = maps.limit(params[:limit] || 300)
    maps
  end
end
