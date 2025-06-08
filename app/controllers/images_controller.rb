class ImagesController < ApplicationController
  before_action :set_image, only: %i[icon image]
  before_action :set_map, only: %i[upload]

  # render image as 200x200px icon with white border
  def icon
    redirect_to "/images/image-not-found_100.webp" and return unless @image
    expires_in 60.minutes, public: true

    # resize, crop if necessary to maintain aspect ratio (centre gravity)
    # TODO: skip first `rounded` for icons with transparency
    image_url = @image.img.thumb("200x200#", quality: 95).rounded.border.rounded.url
    redirect_to image_url
  end

  # render image as uploaded
  def image
    redirect_to "/images/image-not-found.webp" and return unless @image
    expires_in 60.minutes, public: true
    image_url = @image.img.url
    redirect_to image_url
  end

  # convert osmc symbol code to image
  # https://wiki.openstreetmap.org/wiki/Key:osmc:symbol?uselang=en
  def osmc_symbol
    # https://www.wanderreitkarte.de/symbols_en.html
    _waycolor, background, foreground, text, textcolor = params[:osmc_symbol].split(":")
    background = Rails.root.join("public", "icons", "osmc", "background", "#{background}.png")
    foreground = Rails.root.join("public", "icons", "osmc", "#{foreground}.png")
    head :not_found and return unless File.exist?(background)

    # background image is mandatory
    result = MiniMagick::Image.open(background)
    # overlay 1 + 2 are optional
    if File.exist?(foreground)
      image2 = MiniMagick::Image.open(foreground)

      # Overlay image2 on top of image1, centering by default
      result = result.composite(image2) do |c|
        c.compose "Over"
        c.gravity "center"
      end
    end

    if text
      pointsize = 10
      pointsize = 8 if text.size >= 3
      # Add text on top
      result.combine_options do |c|
        c.gravity "center"
        c.pointsize pointsize
        c.draw "text 0,0 '#{text[..2]}'"
        c.fill textcolor || "white"
        c.font Rails.root.join("vendor", "OpenSans-Bold.ttf")
      end
    end

    expires_in 180.minutes, public: true
    send_data result.to_blob, type: "image/png", disposition: "inline"
  end

  def upload
    uploaded_file = params[:image]
    ext = uploaded_file.content_type.split("/").last
    filename = "#{SecureRandom.hex(4)}.#{ext}"
    tempfile = uploaded_file.tempfile

    # resize image if it exceeds 1024px
    image = MiniMagick::Image.read(uploaded_file.tempfile)
    if image.width > 1024 || image.height > 1024
      image.resize "1024x1024" # Maintains aspect ratio, resizes width to 1024px max
      tempfile = Tempfile.new([ "resized-", File.extname(uploaded_file.original_filename) ])
      image.write(tempfile.path)
    end

    uid = Dragonfly.app.store(tempfile, "name" => filename)
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
