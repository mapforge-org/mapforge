require "rails_helper"

describe "Admin quick filter" do
  let(:admin) { create(:user, admin: true) }

  it "keeps the quick filter on search, and the search on filter change" do
    create(:map, name: "Listed one", view_permission: "listed")
    create(:map, name: "Listed two", view_permission: "listed")
    create(:map, name: "Starred one", featured: true)
    sign_in(admin)
    visit admin_path
    within("#quick-filter") { click_link "Public" }
    expect(page).to have_css(".map-card", count: 2)
    fill_in "search", with: "one"
    find("#search").send_keys(:enter)
    expect(page).to have_css(".map-card", count: 1)
    expect(page.current_url).to include("quick=public")
    within("#quick-filter") { click_link "Featured" }
    expect(page).to have_text("Starred one")
    expect(page.current_url).to include("search=one")
  end

  it "searches while typing, and keeps the full filter counts" do
    create(:map, name: "Alpha", view_permission: "listed")
    create(:map, name: "Beta", view_permission: "listed")
    sign_in(admin)
    visit admin_path(quick: "all")
    expect(page).to have_css("#quick-filter .quick-count", text: "2", count: 2)
    find("#search").send_keys("Alpha")
    expect(page).to have_css(".map-card", count: 1)
    expect(page).to have_css("#quick-filter .quick-count", text: "2", count: 2)
  end
end
