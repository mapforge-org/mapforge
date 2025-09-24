class MapsController < ApplicationController
  before_action :set_map_ro, only: %i[show properties feature]
  before_action :set_map_rw, only: %i[destroy]
  before_action :set_map_mode, only: %i[show]
  before_action :set_global_js_values, only: %i[show demo]
  before_action :check_permissions, only: %i[show properties]
  before_action :require_login, only: %i[my]
  before_action :require_map_owner, only: %i[destroy]

  skip_before_action :set_user, only: %i[catchall]
  # site is cookie less for anonymous users, so no csrf token is set
  skip_before_action :verify_authenticity_token, only: %i[create], unless: :set_user

  layout "map", only: [ :show, :demo ]

  def index
    @maps = Map.unscoped.listed.includes(:layers, :user).order(updated_at: :desc)
  end

  def my
    @recent_map_ids = @user.recent_map_ids
    @my_maps = Map.unscoped.where(user: @user).includes(:layers, :user).order(updated_at: :desc)
  end

  def show
    # Avoid 'updated_at' update
    @map.collection.update_one(
      { private_id: @map.private_id },
      { "$set" => { view_count: (@map.view_count || 0) + 1, viewed_at: Time.now } }
    )
    if request.format.html?
      @map_properties = map_properties
      gon.map_id = params[:id]
      @user.track_map_view(params[:id]) if @user
      gon.edit_id = @map.private_id.to_s if @user&.admin? || (@user && @map.user == @user)
      gon.map_mode = @map_mode
      gon.csrf_token = form_authenticity_token
      gon.map_properties = @map_properties
      gon.map_layers = @map.layers.map(&:to_summary_json)
    end

    respond_to do |format|
      format.html do
        case params["engine"]
        when "deck"
          render "deck"
        else
          render "maplibre"
        end
      end
      format.json { render json: @map.to_json }
      format.geojson { render json: @map.to_geojson }
      format.gpx { send_data @map.to_gpx, filename: @map.public_id + ".gpx" }
    end
  end

  def demo
    demo_file = Rails.root.join("db/seeds/demo.json")

    if @user
      unless @map = Map.demo.where(user: @user).first
        @map = Map.create_from_file(demo_file)
        @map.update(user: @user)
      end
    else
      @map = Map.create_from_file(demo_file)
    end
    @map.update(demo: true)
    @map_mode = "rw"

    redirect_to map_url(@map)
  end

  def create
    @map = Map.create!(map_params)
    @map.update(user: @user)

    redirect_to @map.private_map_path, notice: "Map was successfully created."
  end

  # Endpoint for reloading map properties
  def properties
    properties = { properties: map_properties, layers: @map.layers.map(&:to_summary_json) }
    render json: properties
  end

  def feature
    feature = @map.features.find(params["feature_id"])
    head :not_found and return unless feature
    render json: feature.to_geojson
  end

  # some maplibre styles (openfreemap liberty) try to load eg. ./swimming_pool
  # from local server instead of style host... catching those calls here
  # :nocov:
  def catchall
    expires_in 48.hours, public: true
    head :ok
  end
  # :nocov:

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
    return nil unless ret&.found?
    ip_coordinates = [ ret.location.longitude, ret.location.latitude ]
    Rails.logger.info "Client IP: #{request.remote_ip}, coords: #{ip_coordinates.inspect}, loc: #{ret.country.name}/#{ret.city.name}"
    ip_coordinates
  rescue => e
    Rails.logger.error "Error getting IP coordinates: #{e.message}"
    nil
  end
  # :nocov:

  def require_map_owner
    redirect_to maps_path unless @user&.admin? || (@map.user && @map.user == @user)
  end

  def set_global_js_values
    gon.map_keys = Map.provider_keys
  end

  # Use callbacks to share common setup or constraints between actions.
  def set_map_ro
    @map = Map.includes(:user, layers: :features)
    @map = @map.find_by(public_id: params[:id]) || @map.find_by(private_id: params[:id])
    render_not_found unless @map
  end

  def set_map_rw
    @map = Map.includes(:user, layers: :features).find_by(private_id: params[:id])
    render_not_found unless @map
  end

  # Only allow a list of trusted parameters through.
  def map_params
    params.fetch(:map, {})
  end

  def set_map_mode
    @map_mode = (params[:id] == @map.private_id.to_s) ? "rw" : "ro"
    @map_mode = "static" if params["static"]
  end

  def check_permissions
    require_map_owner if [ "ro", "static" ].include?(@map_mode) && @map.view_permission == "private"
    require_map_owner if [ "rw" ].include?(@map_mode) && @map.edit_permission == "private"
  end
end
