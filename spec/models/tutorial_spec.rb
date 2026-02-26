require "rails_helper"

describe Tutorial do
  describe ".find" do
    it "finds existing tutorial" do
      expect(described_class.find("overpass_layers")).to be_a(described_class)
    end
  end
end
