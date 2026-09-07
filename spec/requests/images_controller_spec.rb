require "rails_helper"

describe ImagesController do
  let(:image) { Image.create(img: File.new(Rails.root.join("public/logo/pwa/mapforge-logo-pwa-512.png"))) }

  describe "#image" do
    it "redirects to image" do
      image_url = image.img.url
      expect(get(image_path(public_id: image.public_id))).to redirect_to(image_url)
    end
  end

  describe "#icon" do
    it "redirects to icon" do
      image_url = image.img.thumb("150x150#", quality: 75).rounded_border.url
      expect(get(icon_path(public_id: image.public_id))).to redirect_to(image_url)
    end
  end

  describe "#upload" do
    let(:map) { create(:map) }
    let(:logo) { Rails.root.join("public/logo/pwa/mapforge-logo-pwa-512.png") }

    def upload
      post upload_path, params: { map_id: map.private_id,
                                  image: Rack::Test::UploadedFile.new(logo, "image/png") }
    end

    it "returns 404 without a map with write access" do
      post upload_path, params: { map_id: map.public_id }
      expect(response).to have_http_status(:not_found)
    end

    it "re-uses an image that was uploaded before" do
      expect { upload }.to change(Image, :count).by(1)
      public_id = response.parsed_body["image"]

      expect { upload }.not_to change(Image, :count)
      expect(response.parsed_body["image"]).to eq public_id
    end
  end

  describe "#osmc_symbol" do
    it "returns 404 when background is not found" do
      expect(get(osmc_path(osmc_symbol: "green:pink:green_rectangle:5:white"))).to eq(404)
    end

    it "returns compound image" do
      expect(get(osmc_path(osmc_symbol: "green:red:green_rectangle:5:white"))).to eq(200)
    end
  end
end
