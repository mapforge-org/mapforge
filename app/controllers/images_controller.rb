class ImagesController < ApplicationController
  before_action :set_image, only: %i[icon image]
  before_action :set_map, only: %i[upload]

  def icon
    redirect_to "/images/image-not-found_100.webp" and return unless @image
    expires_in 60.minutes, public: true
    # resize, crop if necessary to maintain aspect ratio (centre gravity)
    image_url = @image.img.thumb("200x200#", quality: 95).rounded.url
    redirect_to image_url
  end

  def image
    redirect_to "/images/image-not-found.webp" and return unless @image
    expires_in 60.minutes, public: true
    image_url = @image.img.url
    redirect_to image_url
  end

  def upload
    file = params[:image]
    ext = file.content_type.split("/").last
    filename = "#{SecureRandom.hex(4)}.#{ext}"
    raise "Image size exceeds 4MB" if file.size / (1024 * 1024) > 4
    uid = Dragonfly.app.store(file.tempfile, "name" => filename)
    img = Image.create!(img_uid: uid, user: @user, map: @map)
    render json: { icon: "/icon/#{img.public_id}", image: "/image/#{img.public_id}" }
  end

  private

  def set_image
    @image = Image.find_by(public_id: params[:public_id])
  end

  def set_map
    @map = Map.find_by(id: params[:map_id])
  end
end
