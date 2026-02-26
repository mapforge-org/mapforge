STORAGE_DIR = "storage/dragonfly"

namespace :migrations do
  desc "Export images from mongoid to fs volume"
  task dragonfly_mongoid_export: :environment do
    Image.each do |image|
      image.destroy && next unless image.img

      # store image on fs, in default location
      date = image.created_at
      name = image.img.send(:uid).split("/").last
      uid = "#{date.year}/#{date.month}/#{date.day}/#{name}"
      ext = begin
        image.img&.mime_type&.split("/")&.last
      rescue
        nil
      end

      puts "#{image.img_uid} -> #{uid}.#{ext}"

      filename = "#{STORAGE_DIR}/#{uid}"
      filename += ".#{ext}" if ext
      FileUtils.mkdir_p(File.dirname(filename))

      File.open(filename, "wb") do |out|
        in_file = image.img.to_file("tmp/#{name}")
        out.write(in_file.read)
        in_file.close
      rescue => e
        puts "Writing #{filename} failed: #{e.message}"
      end
    end
  end

  desc "Import images into mongoid fs volume"
  task dragonfly_fs_import: :environment do
    Image.each do |image|
      image.destroy && next unless image.img

      # store image on fs, in default location
      date = image.created_at
      name = image.img.send(:uid).split("/").last
      uid = "#{date.year}/#{date.month}/#{date.day}/#{name}"

      puts "#{image.img_uid} <- #{uid}"
      # find file with suffix
      filename = Dir[Rails.root + STORAGE_DIR + File.dirname(uid) + "*"].find { |file|
        File.basename(file).start_with?(name)
      }

      begin
        image.update(img: File.new(filename))
      rescue
        puts "#{filename} failed"
      end
    end
  end
end
