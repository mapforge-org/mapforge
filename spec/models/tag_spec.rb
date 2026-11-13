require "rails_helper"

describe Tag do
  describe ".seed_standard" do
    it "creates the standard tags with an English and a German name" do
      described_class.seed_standard

      expect(described_class.count).to eq 10
      hike = described_class.find_by(key: "hike")
      expect(hike.name_translations).to eq("en" => "Hike", "de" => "Wanderung")
      expect(hike.description_translations.keys).to contain_exactly("en", "de")
    end

    it "updates the existing tags on a second run" do
      described_class.create!(key: "hike", name_translations: { "en" => "Old" })
      2.times { described_class.seed_standard }

      expect(described_class.where(key: "hike").count).to eq 1
      expect(described_class.find_by(key: "hike").name_translations["en"]).to eq "Hike"
    end
  end

  describe "#to_s" do
    it "shows the name in the current locale" do
      described_class.seed_standard
      I18n.with_locale(:de) { expect(described_class.find_by(key: "train").to_s).to eq "Zug" }
    end

    it "falls back to the key without a name" do
      expect(described_class.for("custom").to_s).to eq "custom"
    end
  end
end
