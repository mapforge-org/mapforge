class GarminController < ApplicationController
  # Sessions must be active for the OAuth PKCE state/verifier round-trip,
  # even for anonymous users.
  skip_before_action :disable_session_cookies

  rescue_from GarminError, KeyError, with: :garmin_error

  # GET /garmin/authorize?map_id=<public_id>
  # Starts the OAuth PKCE flow.
  def authorize
    @map = Map.find_by(public_id: params[:map_id]) || Map.find_by(private_id: params[:map_id])
    return render_not_found unless @map

    pkce = GarminService.pkce_pair

    session[:garmin] = {
      "map_id"        => @map.public_id,
      "code_verifier" => pkce[:verifier]
    }

    redirect_to GarminService.authorize_url(
      code_challenge: pkce[:challenge],
      state:          @map.public_id,
      redirect_uri:   garmin_callback_url
    ), allow_other_host: true
  end

  # GET /garmin/callback?code=<code>&state=<map_id>
  # Handles the OAuth redirect from Garmin, uploads the GPX as a Course.
  def callback
    garmin_session = session.delete(:garmin) || {}
    map_id         = garmin_session["map_id"]
    code_verifier  = garmin_session["code_verifier"]

    unless map_id && code_verifier && params[:state] == map_id
      return redirect_back_or_root(alert: "Garmin authorization session expired. Please try again.")
    end

    @map = Map.find_by(public_id: map_id)
    return render_not_found unless @map

    token_data   = GarminService.exchange_code(
      code:          params[:code],
      code_verifier: code_verifier,
      redirect_uri:  garmin_callback_url
    )
    access_token = token_data.fetch("access_token")

    gpx = @map.to_gpx

    GarminService.upload_course(
      access_token: access_token,
      gpx:          gpx,
      name:         @map.name.presence || "Mapforge map"
    )

    redirect_to map_path(@map.public_id),
      notice: "Map sent to Garmin Connect! It will appear under Training → Courses after your device syncs."
  end

  private

  def garmin_error(err)
    Rails.logger.error("[GarminController] #{err.message}")
    map_id = session.delete(:garmin)&.dig("map_id")
    if map_id && (map = Map.find_by(public_id: map_id))
      redirect_to map_path(map.public_id), alert: "Could not send map to Garmin Connect: #{err.message}"
    else
      redirect_to root_path, alert: "Could not connect to Garmin Connect. Please try again later."
    end
  end

  def redirect_back_or_root(flash_opts)
    target = session[:garmin]&.dig("map_id")&.then { |id| Map.find_by(public_id: id) }
    if target
      redirect_to map_path(target.public_id), **flash_opts
    else
      redirect_to root_path, **flash_opts
    end
  end
end
