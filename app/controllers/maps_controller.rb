class MapsController < ApplicationController
  before_action :set_map_ro, only: %i[show properties feature]
  before_action :set_map_rw, only: %i[destroy]
  before_action :set_map_mode, only: %i[show]
  before_action :set_global_js_values, only: %i[show]
  before_action :check_permissions, only: %i[show properties]
  before_action :require_login, only: %i[my]
  before_action :require_map_owner, only: %i[destroy]
  skip_before_action :set_user, only: %i[catchall]

  layout "map", only: [ :show ]

  def index
    @maps = Map.unscoped.listed.includes(:layers, :user).order(updated_at: :desc)
  end

  def my
    @maps = Map.unscoped.where(user: @user).includes(:layers, :user).order(updated_at: :desc)
  end

  def show
    if request.format.html?
      @map_properties = map_properties
      gon.map_id = params[:id]
      gon.edit_id = @map.id.to_s if @user&.admin? || (@user && @map.user == @user)
      gon.map_mode = @map_mode
      gon.csrf_token = form_authenticity_token
      gon.map_properties = map_properties
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

  def create
    @map = Map.create!(map_params)
    @map.update(user: @user)

    redirect_to map_url(@map), notice: "Map was successfully created."
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
    # there is an additional broadcast from the model, for the admin page
    render turbo_stream: turbo_stream.remove(@map)
  end

  private

  def map_properties
    properties = @map.properties
    # set calculated center to user location when there are no features
    coords = ip_coordinates
    properties[:default_center] = coords if coords && @map.features_count.zero?
    properties
  end

  # :nocov:
  def ip_coordinates
    # https://github.com/yhirose/maxminddb
    db = MaxMindDB.new("./db/GeoLite2-City.mmdb")
    ret = db.lookup(request.remote_ip)
    return nil unless ret.found?
    ip_coordinates = [ ret.location.latitude, ret.location.longitude ]
    Rails.logger.info "Client IP: #{request.remote_ip}, coords: #{ip_coordinates.inspect}, loc: #{ret.country.name}/#{ret.city.name}"
    ip_coordinates
  rescue => e
    Rails.logger.error "Error getting IP coordinates: #{e.message}"
    Rails.logger.error "See README for instructions on how to set up the MaxMind DB"
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
    @map = @map.find_by(public_id: params[:id]) || @map.find_by(id: params[:id])
    head :not_found unless @map
  end

  def set_map_rw
    @map = Map.includes(:user, layers: :features).find_by(id: params[:id])
    head :not_found unless @map
  end

  # Only allow a list of trusted parameters through.
  def map_params
    params.fetch(:map, {})
  end

  def set_map_mode
    @map_mode = (params[:id] == @map.id.to_s) ? "rw" : "ro"
    @map_mode = "static" if params["static"]
  end

  def check_permissions
    require_map_owner if [ "ro", "static" ].include?(@map_mode) && @map.view_permission == "private"
    require_map_owner if [ "rw" ].include?(@map_mode) && @map.edit_permission == "private"
  end
end
