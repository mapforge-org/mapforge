class ImagesController < ApplicationController
  skip_before_action :set_user, only: %i[icon image]
  before_action :set_image, only: %i[icon image]
  before_action :require_map, only: %i[upload]

  rate_limit to: 250, within: 2.minute, unless: -> { Rails.env.local? }

  IMAGE_CACHE_TIME = 1.week

  # render image as 200x200px icon with white border
  def icon
    redirect_to "/images/image-not-found_100.webp" and return unless @image
    # Sets Cache-Control headers for HTTP caching and rack_cache
    expires_in IMAGE_CACHE_TIME, public: true

    # resize, crop if necessary to maintain aspect ratio (centre gravity)
    # TODO: skip first `rounded` for icons with transparency
    image_url = @image.img.thumb("200x200#", quality: 95).rounded.border.rounded.url
    redirect_to image_url
  end

  # render image as uploaded
  def image
    redirect_to "/images/image-not-found.webp" and return unless @image
    # Sets Cache-Control headers for HTTP caching and rack_cache
    expires_in IMAGE_CACHE_TIME, public: true
    image_url = @image.img.url
    redirect_to image_url
  end

  # convert osmc symbol code to image
  # https://wiki.openstreetmap.org/wiki/Key:osmc:symbol?uselang=en
  def osmc_symbol
    # https://www.wanderreitkarte.de/symbols_en.html
    result = Mapforge::OsmcSymbolGenerator.generate(params[:osmc_symbol])

    head :not_found and return unless result

    expires_in IMAGE_CACHE_TIME, public: true
    send_data result.to_blob, type: "image/png", disposition: "inline"
  end

  # upload image
  def upload
    uploaded_file = params[:image]
    ext = uploaded_file.content_type.split("/").last
    tempfile = uploaded_file.tempfile
    # Avoid duplicate files by identifying uploaded files by <name>-<size>
    filename = uploaded_file.original_filename.gsub(/[^0-9A-Za-z.\-_]/, "_")
    filename = filename.sub(/\.[^\.]*$/, "")
    filename = "#{filename}-#{tempfile.size}.#{ext}"

    # use existing image if already uploaded
    unless img = Image.find_by(public_id: filename)
      # resize image if it exceeds 1024px
      image = MiniMagick::Image.read(tempfile)
      if image.width > 1024 || image.height > 1024
        image.resize "1024x1024" # Maintains aspect ratio, resizes width to 1024px max
        image.quality "75"
        tempfile = Tempfile.new([ "resized-", File.extname(uploaded_file.original_filename) ])
        image.write(tempfile.path)
      end

      uid = Dragonfly.app.store(tempfile, "name" => filename) # name needs to be a string here
      img = Image.create!(img_uid: uid, public_id: filename, user: @user)
    end
    render json: { icon: "/icon/#{img.public_id}", image: "/image/#{img.public_id}" }
  end

  private

  def set_image
    @image = Image.find_by(public_id: params[:public_id])
  end

  def require_map
    @map = Map.find_by!(private_id: params[:map_id])
  end
end
