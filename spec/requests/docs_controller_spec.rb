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
  end
end
