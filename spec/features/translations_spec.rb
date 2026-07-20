require "rails_helper"
require "po_to_json"
require "gettext_i18n_rails_js/parser"
require "gettext_i18n_rails_js/task"

describe "Translations" do
  before do
    # Drop the generated JS locale dirs, then regenerate them from scratch.
    FileUtils.rm_rf(Rails.root.glob("app/assets/javascripts/locale/*/"))
    silence_stdout { GettextI18nRailsJs::Task.po_to_json }
  end

  context "with valid locale" do
    before { visit root_path(locale: "de") }

    it "translates Haml strings" do
      expect(page).to have_text("Gestalte deine eigene Karte")
    end

    it "translates JavaScript strings" do
      expect(page.evaluate_script("document.documentElement.lang")).to eq("de")
      expect(page.evaluate_script("window.__('Delete')")).to eq("Löschen")
    end
  end

  context "with invalid locale" do
    before { visit root_path(locale: "xx") }

    it "falls back to the default locale" do
      expect(page.evaluate_script("document.documentElement.lang")).to eq("en")
      expect(page).to have_text("Create your own map")
    end
  end

  def silence_stdout
    original = $stdout
    $stdout = StringIO.new
    yield
  ensure
    $stdout = original
  end
end
