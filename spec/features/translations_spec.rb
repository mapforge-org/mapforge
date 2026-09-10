require "rails_helper"
require "po_to_json"
require "gettext_i18n_rails_js/parser"
require "gettext_i18n_rails_js/task"

# The Haml translation and the locale fallback are server rendered, see the request
# spec spec/requests/application_controller_spec.rb. Only the generated JS locale
# files need a browser.
describe "Translations" do
  before do
    # Drop the generated JS locale dirs, then regenerate them from scratch.
    FileUtils.rm_rf(Rails.root.glob("app/assets/javascripts/locale/*/"))
    silence_stdout { GettextI18nRailsJs::Task.po_to_json }
    visit root_path(locale: "de")
  end

  it "translates JavaScript strings" do
    expect(page.evaluate_script("window.__('Delete')")).to eq("Löschen")
    # the search synonyms of one category are one string
    expect(page.evaluate_script("window.__('toilet|wc|restroom|lavatory')")).to include("Toilette")
  end

  def silence_stdout
    original = $stdout
    $stdout = StringIO.new
    yield
  ensure
    $stdout = original
  end
end
