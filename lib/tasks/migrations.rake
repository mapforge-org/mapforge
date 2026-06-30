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

  desc "Convert all existing Dragonfly images to WebP (resize to 1024 + quality 75). DRY_RUN=1 to report only."
  task dragonfly_to_webp: :environment do
    dry_run = ENV["DRY_RUN"].present?
    puts dry_run ? "DRY RUN - no files will be changed" : "Converting images to WebP..."

    converted = skipped = failed = 0
    original_total = new_total = 0

    Image.each do |image|
      unless image.img
        skipped += 1
        next
      end

      # already WebP (covers files uploaded after the WebP switch)
      if image.img.mime_type == "image/webp"
        skipped += 1
        next
      end

      begin
        original_size = image.img.size
        tempfile = image.img.to_file("tmp/webp_#{image.id}")
        Image.compress_to_webp!(tempfile.path)
        new_size = File.size(tempfile.path)

        original_total += original_size
        new_total += new_size
        converted += 1

        pct = ((1 - new_size.to_f / original_size) * 100).round(1)
        puts "#{image.img_uid} #{(original_size / 1024.0).round}KB -> #{(new_size / 1024.0).round}KB (-#{pct}%)"

        unless dry_run
          name = "#{image.img.send(:uid).split('/').last.sub(/\.[^.]*$/, '')}.webp"
          image.img = File.open(tempfile.path)
          image.img.name = name
          image.save!
        end
      rescue => e
        failed += 1
        puts "FAILED #{image.img_uid}: #{e.message}"
      ensure
        tempfile&.close
        File.delete(tempfile.path) if tempfile && File.exist?(tempfile.path)
      end
    end

    saved = original_total - new_total
    puts "\n#{dry_run ? '[DRY RUN] ' : ''}Done."
    puts "Converted: #{converted}, skipped: #{skipped}, failed: #{failed}"
    puts "Before: #{(original_total / 1024.0 / 1024).round(1)}MB, after: #{(new_total / 1024.0 / 1024).round(1)}MB"
    puts "Saved: #{(saved / 1024.0 / 1024).round(1)}MB (#{original_total.positive? ? ((saved.to_f / original_total) * 100).round(1) : 0}%)"
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
