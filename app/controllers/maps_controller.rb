class MapsController < ApplicationController
  include MapListFilters

  before_action :set_map, only: %i[show properties feature layer destroy copy]
  before_action :set_map_mode, only: %i[show layer]
  before_action :join, only: %i[show]
  before_action :set_global_js_values, only: %i[show tutorial]
  before_action :check_permissions, only: %i[show properties layer]
  before_action :require_login, only: %i[my create copy]
  before_action :require_map_owner, only: %i[destroy]

  rate_limit to: 5, within: 15.minutes, only: :create

  layout "map", only: [ :show, :tutorial ]

  def index
    @maps = filter_and_sort_maps(Map.unscoped.listed.includes(:layers, :owners))
  end

  def my
    @recent_maps = load_recent_maps(@user.recent_map_ids)
    @my_maps = filter_and_sort_maps(@user.owned_maps.includes(:layers, :owners))

    respond_to do |format|
      format.html # full page
      format.turbo_stream # for partial updates via Turbo/Stimulus
    end
  end

  def show
    respond_to do |format|
      format.html do
        unless params["viewcount"] == "false"
          # Defer view_count update until after the response is flushed so it doesn't add to TTFB.
          map = @map
          request.env["rack.after_reply"] ||= []
          request.env["rack.after_reply"] << -> {
            # Avoid 'updated_at' update
            map.collection.update_one(
              { _id: map.id },
              { "$set" => { view_count: (map.view_count || 0) + 1, viewed_at: Time.now } }
            )
          }
        end
        @map_properties = map_properties
        @user&.track_map_view(params[:id])

        gon.map_id = params[:id]
        gon.user_id = @user.id if @user
        gon.edit_id = @map.private_id.to_s if @user&.admin? || @map.owned_by?(@user)
        gon.map_mode = @map_mode
        gon.rails_env = Rails.env
        gon.csrf_token = form_authenticity_token
        gon.map_properties = @map_properties
        gon.map_layers = @map.layers.map(&:to_summary_json)
        gon.map_updated_at = @map.updated_at

        case params["engine"]
        when "deck"
          render "deck"
        else
          render "maplibre"
        end
      end
      format.json do
        # updated_at bumps on any feature/layer/map change via the touch chain,
        # so it's a sufficient (and private) validator for a 304 on repeat loads.
        if stale?(etag: @map.updated_at)
          render json: @map.to_json(include_features: params[:export].present?)
        end
      end
      format.geojson { render json: @map.to_geojson }
      format.gpx do
        name = @map.name.presence&.parameterize || @map.public_id
        send_data @map.to_gpx, filename: name + ".gpx", disposition: "attachment"
      end
    end
  end

  def tutorial
    @map = Map.tutorial_map(@user)
    redirect_to map_url(id: @map.private_id)
  end

  def create
    # Setting map center to user IP location (will reset on first feature)
    coords = ip_coordinates
    @map = Map.new(center: coords || Map::DEFAULT_CENTER)
    @map.add_owner(@user)
    @map.save!

    redirect_to @map.private_map_path, notice: "Map was successfully created."
  end

  def copy
    require_map_owner if @map.view_permission == "private"
    cloned_map = @map.clone_with_layers
    cloned_map.update(owners: [ @user ], name: "Copy of " + @map.name.to_s)
    redirect_to cloned_map.private_map_path, notice: "Map was successfully copied."
  end

  # Endpoint for reloading map properties
  def properties
    properties = { properties: map_properties, updated_at: @map.updated_at, layers: @map.layers.map(&:to_summary_json) }
    render json: properties
  end

  def feature
    feature = @map.features.find(params["feature_id"])
    head :not_found and return unless feature
    respond_to do |format|
      format.geojson { render json: feature.to_geojson }
      format.gpx {
        name = feature.properties["title"].presence || feature.id
        send_data feature.to_gpx, filename: "#{name}.gpx", disposition: "attachment"
      }
    end
  end

  def layer
    layer = @map.layers.find(params["layer_id"])
    head :not_found and return unless layer
    # Sending 304 on repeat loads un unchanged layer.
    render json: layer.to_geojson if stale?(etag: layer.updated_at)
  end

  # Turbo sends the DELETE request automatically with Content-Type: text/vnd.turbo-stream.html
  # We can return a turbo stream command that removes the map element in place
  # To avoid turbo_stream response, force format :html
  def destroy
    @map.destroy!
    # there is an additional broadcast from the model, for the public + admin lists
    render turbo_stream: turbo_stream.action("remove_class", "map_#{@map.public_id}")
  end

  private

  def map_properties
    properties = @map.properties
    # set calculated center to user location when there are no features
    if @map.features_count.zero?
      coords = ip_coordinates
      properties[:default_center] = coords if coords
    end
    properties
  end

  # :nocov:
  def ip_coordinates
    # https://github.com/yhirose/maxminddb
    ret = MAXMIND_DB&.lookup(request.remote_ip)
    unless ret&.found?
      Rails.logger.warn "Cannot detect location for IP #{request.remote_ip}"
      Yabeda.geolocation_lookup_failures.increment({})
      return nil
    end
    ip_coordinates = [ ret.location.longitude, ret.location.latitude ]
    Rails.logger.info "Client IP: #{request.remote_ip}, coords: #{ip_coordinates.inspect}, loc: #{ret.country.name}/#{ret.city.name}"
    Yabeda.geolocation_lookup_successes.increment({})
    ip_coordinates
  rescue => e
    Rails.logger.error "Error getting IP coordinates: #{e.message}"
    Yabeda.geolocation_lookup_failures.increment({})
    nil
  end
  # :nocov:

  # Batch-load recent maps in 2 queries instead of 2N individual find_by calls.
  # Looks up by private_id (rw) and public_id (ro), preserving view order.
  def load_recent_maps(ids)
    return [] if ids.blank?
    by_private = Map.unscoped.in(private_id: ids).includes(:owners).index_by(&:private_id)
    by_public = Map.unscoped.in(public_id: ids).includes(:owners).index_by(&:public_id)
    ids.filter_map do |id|
      if (map = by_private[id])
        [ map, true ]
      elsif (map = by_public[id])
        [ map, false ]
      end
    end
  end

  def require_map_owner
    if !(@user&.admin? || @map.owned_by?(@user))
      Rails.logger.warn "Map view requires owner permissions, but current user isn't."
      redirect_to maps_path
    end
  end

  def set_global_js_values
    gon.map_keys = Map.provider_keys
  end

  def set_map
    @map = Map.unscoped.where(:$or => [ { public_id: params[:id] }, { private_id: params[:id] } ]).first
    render_not_found unless @map
  end

  def set_map_mode
    @map_mode = (params[:id] == @map.private_id.to_s) ? "rw" : "ro"
    @map_mode = "static" if params["static"]
    allow_iframe if @map_mode == "ro" || params["static"]
  end

  def join
    if @map_mode == "rw" && params["join"] == "true" && @user
      @map.add_owner(@user)
    end
  end

  def check_permissions
    require_map_owner if [ "ro", "static" ].include?(@map_mode) && @map.view_permission == "private"
    require_map_owner if [ "rw" ].include?(@map_mode) && @map.edit_permission == "private"
  end
end
