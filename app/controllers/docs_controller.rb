class DocsController < ApplicationController
  STYLE_SPEC = "geojson_style_spec".freeze

  layout "map", only: :style_preview

  # style_preview renders the map view, which renders its partials relative to app/views/maps
  def self.local_prefixes
    super + [ "maps" ]
  end

  def tutorials
  end

  def tutorial
    tutorial = Tutorial.find(params[:id])
    respond_to do |format|
      format.html do
        @title = tutorial.title
        if tutorial.name == STYLE_SPEC
          @properties = StyleSpec.properties
          render "styling"
        else
          @html_content = tutorial.to_html
        end
      end
      format.md { render markdown: tutorial.markdown }
    end
  end

  # The map of the styling playground iframe. The map is never saved, its one layer
  # gets the features from the playground page through postMessage.
  def style_preview
    @map = Map.new(center: Map::DEFAULT_CENTER, zoom: 14)
    @map_mode = "ro"
    @map_properties = @map.properties
    gon.map_mode = @map_mode
    gon.rails_env = Rails.env
    gon.map_keys = Map.provider_keys
    gon.map_properties = @map_properties
    gon.map_layers = [ { id: "preview", type: "geojson", name: "Preview", show: true,
                         geojson: { type: "FeatureCollection", features: [] } } ]
    gon.style_preview = true
    render "maps/maplibre"
  end
end
