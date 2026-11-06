require "rails_helper"

describe "Frontpage" do
  before { visit root_path }

  def video_paused?
    page.evaluate_script("document.querySelector('.landing-video video').paused")
  end

  def video_time
    page.evaluate_script("document.querySelector('.landing-video video').currentTime")
  end

  it "loads the demo only when the visitor plays it" do
    expect(page).to have_css(".landing-video video[preload='none'][poster*='demo_poster.webp']")
    find(".landing-video-play").click

    expect(page).to have_no_css(".landing-video-play")
    wait_for { video_paused? }.to be false
  end

  it "pauses the demo on a click and shows the play button again" do
    find(".landing-video-play").click
    wait_for { video_time }.to be > 0

    find(".landing-video video").click
    expect(page).to have_css(".landing-video-play")
    expect(video_paused?).to be true

    find(".landing-video-play").click
    expect(page).to have_no_css(".landing-video-play")
    wait_for { video_paused? }.to be false
  end

  it "stops at the end of the demo and can play it again" do
    find(".landing-video-play").click
    wait_for { video_time }.to be > 0

    page.execute_script("(v => { v.currentTime = v.duration - 0.1 })(document.querySelector('.landing-video video'))")
    expect(page).to have_css(".landing-video-play")
    expect(video_paused?).to be true

    find(".landing-video-play").click
    expect(page).to have_no_css(".landing-video-play")
    wait_for { video_paused? }.to be false
  end

  it "pauses the demo with the keyboard" do
    find(".landing-video-play").click
    wait_for { video_time }.to be > 0

    page.driver.browser.keyboard.type(:space)
    expect(page).to have_css(".landing-video-play")
    expect(video_paused?).to be true
  end

  context "when logged in" do
    before do
      sign_in(create(:user))
      visit root_path
    end

    it "leaves the start button to the header" do
      expect(page).to have_css(".navbar .btn-create-map")
      within("[data-frontpage-route-target='actions']") do
        expect(page).to have_link("Your maps")
        expect(page).to have_no_button("Start a map")
      end
    end

    it "keeps the start button while the header is folded", :phone do
      within("[data-frontpage-route-target='actions']") { expect(page).to have_button("Start a map") }
    end
  end

  it "draws the route through the feature pins" do
    expect(page).to have_css(".landing-route-pin", visible: :all, count: 9)
    expect(find("[data-frontpage-route-target='path'][d]", visible: :all)[:d]).to match(/\AM[\d.-]+ [\d.-]+ C/)
  end

  it "keeps the route inside the page on phones", :phone do
    expect(page).to have_css(".landing-route path[d]")
    expect(page).to have_no_css(".landing-checks")
    expect(find("[data-frontpage-route-target='path']")[:d]).not_to include("NaN")

    right = page.evaluate_script("(b => b.x + b.width)(document.querySelector('.landing-route path').getBBox())")
    expect(right).to be <= page.evaluate_script("document.querySelector('#frontpage').clientWidth")
  end
end
