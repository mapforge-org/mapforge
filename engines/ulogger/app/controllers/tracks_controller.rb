class TracksController < ApplicationController
  def redirect
    if params[:id].present?
      padded = "%024d" % [ params[:id] ]
      map = Map.find_by(private_id: padded)
      if map
        # link to highlighted track
        track = map.features.line_string.first
        if track
          redirect_to map_path(id: map.public_id, f: track.id)
        else
          redirect_to map.public_map_path
        end
      else
        Rails.logger.warn("Ulogger map '#{params[:id]}' not found")
        render_not_found
      end
    end
  end
end
