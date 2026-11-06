require "rails_helper"

describe "Frontpage" do
  before { visit root_path }

  it "loads the demo only when the visitor plays it" do
    expect(page).to have_css(".landing-video video[preload='none'][poster*='demo_poster.webp']")
    find(".landing-video-play").click

    expect(page).to have_no_css(".landing-video-play")
    wait_for { page.evaluate_script("document.querySelector('.landing-video video').paused") }.to be false
  end

  it "draws the route through the feature pins" do
    expect(page).to have_css(".landing-route-pin", visible: :all, count: 5)
    expect(find(".landing-route path", visible: :all)[:d]).to match(/\AM[\d.-]+ [\d.-]+ C/)
  end

  it "keeps the route inside the page on phones", :phone do
    expect(page).to have_css(".landing-route path[d]")
    expect(page).to have_no_css(".landing-checks")
    expect(find(".landing-route path")[:d]).not_to include("NaN")

    right = page.evaluate_script("(b => b.x + b.width)(document.querySelector('.landing-route path').getBBox())")
    expect(right).to be <= page.evaluate_script("document.querySelector('#frontpage').clientWidth")
  end
end
