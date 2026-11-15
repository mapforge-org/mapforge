require "rails_helper"

describe DocsController do
  describe "#tutorials" do
    it "renders list of tutorials" do
      expect(get(docs_path)).to eq(200)
    end
  end

  describe "#tutorial" do
    it "renders tutorial file as html" do
      expect(get(doc_path(id: "overpass_layers"))).to eq(200)
    end

    it "returns 404 when not found" do
      expect(get(doc_path(id: "not_there"))).to eq(404)
    end

    it "renders the style spec as playground with property cards" do
      expect(get(doc_path(id: "geojson_style_spec"))).to eq(200)
      expect(response.body).to include('id="property-fill-pattern"', 'id="property-label-anchor"', "<iframe")
    end

    it "keeps the markdown of the style spec" do
      expect(get(doc_path(id: "geojson_style_spec", format: :md))).to eq(200)
      expect(response.body).to start_with("# Advanced feature styling")
    end
  end

  describe "#style_preview" do
    it "renders a map with the preview layer and no saved map" do
      expect { get(docs_style_preview_path(nomenu: true)) }.not_to change(Map, :count)
      expect(response).to have_http_status(200)
      expect(response.body).to include("gon.style_preview=true", "maplibre-map")
    end
  end
end
