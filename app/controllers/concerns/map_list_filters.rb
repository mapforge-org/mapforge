module MapListFilters
  extend ActiveSupport::Concern

  def filter_and_sort_maps(maps)
    @sort = params[:sort] || "updated_at"
    @direction = params[:direction] || "desc"
    @search = params[:search].to_s.strip

    maps = maps.search(@search) unless @search.empty?
    maps = maps.sorted(@sort, @direction)
    maps = maps.limit(params[:limit] || 300)
    maps
  end
end
