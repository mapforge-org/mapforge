require "rails_helper"

describe "Icon sets", type: :request do
  let(:pinhead) { Rails.public_path.join("icon-sets/pinhead") }

  it "links every maki name to an existing pinhead icon" do
    links = pinhead.glob("*.png").select(&:symlink?)
    expect(links.size).to be > 100
    expect(links.reject(&:exist?)).to be_empty
    expect(pinhead.join("cafe.png").readlink.to_s).to eq("cup_and_saucer.png")
  end

  it "serves the pinhead icon for a maki name" do
    get "/icon-sets/pinhead/cafe.png"
    expect(response).to have_http_status(200)
    expect(response.body).to eq(pinhead.join("cup_and_saucer.png").binread)
  end
end
