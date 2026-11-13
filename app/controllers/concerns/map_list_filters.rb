module MapListFilters
  extend ActiveSupport::Concern

  SORT_COLUMNS = %w[created_at updated_at view_count].freeze

  included do
    helper_method :tag_options, :maps_to_filter?
  end

  def filter_and_sort_maps(maps, default_sort: "updated_at")
    sort_maps(search_maps(maps), default_sort:)
  end

  def search_maps(maps)
    @unsearched_maps = maps
    @search = @filter = params[:search].to_s.strip
    @tag = params[:tag].to_s.strip
    if @search.include? "user:"
      @filter = @search.sub(/\buser:(\S+)\s*/, "").strip
      userid = $1
      @searchuser = User.find(userid) if userid.present?
    end
    tags = Array(@tag.presence)
    @filter = @filter.gsub(/(?:^|\s)(?:tag:|#)(\S+)/) { tags << $1; "" }.strip

    if @searchuser
      # Find maps where user is in owner_ids array
      maps = maps.where(owner_ids: @searchuser.id)
    end
    tags.each { |tag| maps = maps.tagged(Tag.named(tag)) }
    maps = maps.search(@filter) unless @filter.empty?
    maps
  end

  # Before the search and the admin quick filter, so the form stays when they find nothing
  def maps_to_filter?
    @unsearched_maps.exists?
  end

  # The tags of the maps in the list, before the search, with their number of maps.
  # A helper, so only the full page runs the counts, not the turbo stream updates.
  def tag_options
    counts = Map.collection.aggregate([
      { "$match" => @unsearched_maps.selector },
      { "$unwind" => "$tag_ids" },
      { "$group" => { "_id" => "$tag_ids", "count" => { "$sum" => 1 } } }
    ]).to_h { |row| [ row["_id"], row["count"] ] }
    Tag.in(id: counts.keys).map { |tag| [ tag.to_s, counts[tag.id] ] }.sort
  end

  def sort_maps(maps, default_sort: "updated_at")
    @sort = SORT_COLUMNS.include?(params[:sort]) ? params[:sort] : default_sort
    @direction = params[:direction] || "desc"
    maps.sorted(@sort, @direction).limit(300)
  end
end
