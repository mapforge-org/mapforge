require 'rails_helper'

describe ImagesController do
  let(:image) { Image.create(img: File.new(Rails.root.join('public/icons/mapforge-logo.png'))) }

  describe '#image' do
   it 'redirects to image' do
     image_url = image.img.url
     expect(get image_path(public_id: image.public_id)).to redirect_to(image_url)
   end
  end

  describe '#icon' do
    it 'redirects to icon' do
      image_url = image.img.thumb("200x200#", quality: 95).rounded.border.rounded.url
      expect(get icon_path(public_id: image.public_id)).to redirect_to(image_url)
    end
  end

  describe '#osmc_symbol' do
    it 'returns 404 when background is not found' do
      expect(get osmc_path(osmc_symbol: "green:pink:green_rectangle:5:white")).to eq(404)
    end

    it 'returns compound image' do
      expect(get osmc_path(osmc_symbol: "green:red:green_rectangle:5:white")).to eq(200)
    end
  end
end
