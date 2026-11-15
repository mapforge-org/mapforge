require "rails_helper"

describe "Icon sets", type: :request do
  let(:pinhead) { Rails.public_path.join("icon-sets/pinhead") }

  it "has no dangling link" do
    links = pinhead.glob("*.png").select(&:symlink?)
    expect(links.size).to be > 100
    expect(links.reject(&:exist?)).to be_empty
  end

  it "links a maki name and a renamed pinhead id to an icon" do
    expect(pinhead.join("cafe.png")).to be_symlink
    expect(pinhead.join("five.png").readlink.to_s).to eq("5.png")
  end

  it "has a number icon from 0 to 50, the composed ones in the mapforge folder" do
    expect((0..50).map { |number| pinhead.join("#{number}.png") }).to all(be_file)
    expect(pinhead.join("17.png").readlink.to_s).to eq("../mapforge/17.png")
    expect(Rails.public_path.join("icon-sets/mapforge/17.png")).not_to be_symlink
  end

  it "lists the numbers first in the picker, in their order" do
    ids = JSON.parse(pinhead.join("index.json").read)["emojis"].map { |emoji| emoji["id"] }
    expect(ids.first(51)).to eq((0..50).map { |number| "pinhead-#{number}" })
  end

  it "serves a composed number through its pinhead path" do
    get "/icon-sets/pinhead/42.png"
    expect(response).to have_http_status(200)
    expect(response.body).to eq(Rails.public_path.join("icon-sets/mapforge/42.png").binread)
  end

  it "serves the pinhead icon for a maki name" do
    get "/icon-sets/pinhead/cafe.png"
    expect(response).to have_http_status(200)
    expect(response.body).to eq(pinhead.join("cafe.png").realpath.binread)
  end
end
