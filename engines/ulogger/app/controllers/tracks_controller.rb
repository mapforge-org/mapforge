class TracksController < ApplicationController
  def redirect
    if params[:id]
      padded = "%024d" % [ params[:id] ]
      map = Map.find(padded)
      if map
        # link to highlighted track
        track = map.features.line_string.first
        if track
          redirect_to map_path(id: map.public_id, f: track.id)
        else
          redirect_to map_path(id: map.public_id)
        end
      else
        Rails.logger.warn("Ulogger map '#{params[:id]}' not found")
        render status: :not_found
      end
    end
  end
end
