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
      image_url = image.img.thumb("200x200#", quality: 95).rounded.url
      expect(get icon_path(public_id: image.public_id)).to redirect_to(image_url)
    end
  end
end
