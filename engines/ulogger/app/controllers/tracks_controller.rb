class TracksController < ApplicationController
  def redirect
    if params[:id]
      padded = "%024d" % [ params[:id] ]
      map = Map.find(padded)
      track = map.features.line_string.first
      if map
        # link to highlighted track
        redirect_to map_path(id: map.public_id, f: track.id)
      else
        Rails.logger.warn("Ulogger map '#{params[:id]}' not found")
        render status: :not_found
      end
    end
  end
end
