require "rails_helper"

describe "Frontpage" do
  before { visit root_path }

  it "loads the demo only when the visitor plays it" do
    expect(page).to have_css("img[src*='demo_poster.webp']")
    find(".landing-video-play").click

    expect(page).to have_css(".landing-video img[src*='demo.webp']")
    expect(page).to have_no_css(".landing-video-play")
  end

  it "draws the route through the feature pins" do
    expect(page).to have_css(".landing-route-pin", visible: :all, count: 5)
    expect(find(".landing-route path", visible: :all)[:d]).to match(/\AM[\d.-]+ [\d.-]+ C/)
  end
end
