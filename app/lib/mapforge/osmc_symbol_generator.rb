require "mini_magick"

module Mapforge
  class OsmcSymbolGenerator
    def self.generate(osmc_symbol)
      _waycolor, background, foreground, text, textcolor = osmc_symbol.split(":")

      raise ActionController::BadRequest, "Invalid background filename '#{background}'" unless background =~ /\A[\w.-]+\z/
      raise ActionController::BadRequest, "Invalid foreground filename '#{foreground}'" unless foreground.blank? || foreground =~ /\A[\w.-]+\z/

      background_img = Rails.root.join("public", "icons", "osmc", "background", "#{File.basename(background)}.png")
      foreground_img = Rails.root.join("public", "icons", "osmc", "#{File.basename(foreground)}.png")

      # background image is mandatory
      return nil unless File.exist?(background_img)
      result = MiniMagick::Image.open(background_img)

      # overlay 1 + 2 are optional
      if File.exist?(foreground_img)
        image2 = MiniMagick::Image.open(foreground_img)

        # Overlay image2 on top of image1, centering by default
        result = result.composite(image2) do |c|
          c.compose "Over"
          c.gravity "center"
        end
      end

      if text && !text.blank? && text.size <= 4
        pointsize = 11
        pointsize = 10 if text.size == 2
        pointsize = 8 if text.size == 3
        pointsize = 7 if text.size == 4
        # Add text on top
        text = text.gsub(/[^[:alpha:][0-9] .,_-]/, " ")
        result.combine_options do |c|
          c.gravity "center"
          c.pointsize pointsize
          c.draw "text 0,0 '#{text}'"
          c.fill textcolor || "white"
          c.font Rails.root.join("vendor", "OpenSans-Bold.ttf")
        end
      end

      result
    end
  end
end
