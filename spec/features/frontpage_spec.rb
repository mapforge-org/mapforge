require "rails_helper"

describe "Frontpage" do
  before { visit root_path }

  it "scrolls to the feature tour instead of reloading the page" do
    page.execute_script("window.turboVisited = false; addEventListener('turbo:visit', () => { window.turboVisited = true })")
    click_link "Feature Tour"

    expect(page.evaluate_script("location.hash")).to eq("#features")
    expect(page.evaluate_script("window.turboVisited")).to be false
    expect(page.evaluate_script("window.scrollY")).to be > 0
  end
end
