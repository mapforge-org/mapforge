#!/usr/bin/env ruby
# Builds the icon sets under public/icon-sets from their npm packages.
#
# MapLibre cannot load an SVG into 'icon-image', so every icon is rasterized to a PNG of the
# same size as the emojis in public/icon-sets/noto. The output is committed, this script only
# runs when a set gets added or updated. See public/icon-sets/README.
#
# Usage: bin/build_icon_sets.rb [set ...]   (default: all sets)

require "fileutils"
require "json"
require "tmpdir"

SIZE = 72

EMOJI_DATA = "public/icon-sets/noto/emoji-mart-data.json"

SETS = {
  "maki" => {
    package: "@mapbox/maki",
    name: "Maki",
    icon: "marker"
  },
  "temaki" => {
    package: "@ideditor/temaki",
    name: "Temaki",
    icon: "temaki",
    # data/icons.json lists a group per icon, which becomes an extra search keyword
    groups: "data/icons.json"
  },
  # the pngs of an emoji set are downloaded by hand, only its index gets built
  "openmoji" => {
    name: "OpenMoji",
    icon: "🗺",
    emoji_data: true
  }
}

def run(*command)
  system(*command, exception: true)
end

def download(package, dir)
  run("npm", "pack", "--silent", "--pack-destination", dir, package)
  tarball = Dir.glob(File.join(dir, "*.tgz")).first
  run("tar", "xzf", tarball, "-C", dir)
  File.join(dir, "package")
end

# 'alcohol-shop' and 'alcohol_shop' both become 'Alcohol shop' with the keywords of both parts
def humanize(id)
  id.tr("-_", " ").capitalize
end

def rasterize(source, target)
  FileUtils.mkdir_p(target)
  svgs = Dir.glob(File.join(source, "*.svg"))
  raise "no icons in #{source}" if svgs.empty?

  # One inkscape run for all icons: the startup of the process costs more than the export.
  # --export-type writes the png next to its svg, so the svgs are copied over and removed after.
  FileUtils.cp(svgs, target)
  run("inkscape", "--export-type=png", "--export-width=#{SIZE}", "--export-height=#{SIZE}",
      *Dir.glob(File.join(target, "*.svg")))
  FileUtils.rm(Dir.glob(File.join(target, "*.svg")))
  # The sets are monochrome black. A marker draws them on a circle in the color of the
  # feature, where white reads better, so only the alpha channel of the icon is kept.
  run("magick", "mogrify", "-channel", "RGB", "-evaluate", "set", "100%",
      *Dir.glob(File.join(target, "*.png")))
  svgs.map { |svg| File.basename(svg, ".svg") }
end

# The shape of one entry of the 'custom' option of emoji-mart. The id must be unique across the
# whole picker, so it carries the name of the set.
def index(set, config, ids, groups)
  {
    id: set,
    name: config[:name],
    icon: { src: "/icon-sets/#{set}/#{config[:icon]}.png" },
    emojis: ids.sort.map do |id|
      {
        id: "#{set}-#{id}",
        name: humanize(id),
        keywords: (id.split(/[-_]/) + groups.fetch(id, [])).uniq,
        skins: [ { src: "/icon-sets/#{set}/#{id}.png" } ]
      }
    end
  }
end

# An emoji set brings one png per emoji, named after the emoji character (see
# convert_to_emoji_names.sh). The name without the variation selector FE0F comes first,
# because a marker-symbol carries no FE0F either.
def emoji_file(target, native)
  [ native.delete("\uFE0F"), native ]
    .map { |name| "#{name}.png" }
    .find { |file| File.exist?(File.join(target, file)) }
end

# The index of an emoji set, built from the names and keywords of the emoji data
def emoji_index(set, config, target, root)
  data = JSON.parse(File.read(File.join(root, EMOJI_DATA)))
  emojis = data["emojis"].values.filter_map do |emoji|
    file = emoji_file(target, emoji["skins"].first["native"]) or next
    {
      id: "#{set}-#{emoji["id"]}",
      name: emoji["name"],
      keywords: emoji["keywords"],
      skins: [ { src: "/icon-sets/#{set}/#{file}" } ]
    }
  end
  { id: set, name: config[:name], icon: { src: "/icon-sets/#{set}/#{config[:icon]}.png" }, emojis: emojis }
end

def build(set, config, root)
  target = File.join(root, "public", "icon-sets", set)
  if config[:emoji_data]
    index = emoji_index(set, config, target, root)
    File.write(File.join(target, "index.json"), JSON.generate(index))
    return puts "#{set}: #{index[:emojis].size} icons"
  end

  Dir.mktmpdir("icon-set-#{set}") do |tmp|
    package = download(config[:package], tmp)
    ids = rasterize(File.join(package, "icons"), target)
    groups = config[:groups] ? JSON.parse(File.read(File.join(package, config[:groups]))) : {}
    groups = groups.transform_values { |v| v["groups"] || [] }
    File.write(File.join(target, "index.json"), JSON.pretty_generate(index(set, config, ids, groups)))
    puts "#{set}: #{ids.size} icons"
  end
end

root = File.expand_path("..", __dir__)
sets = ARGV.empty? ? SETS.keys : ARGV
sets.each do |set|
  config = SETS[set] or abort("unknown icon set '#{set}', known: #{SETS.keys.join(", ")}")
  build(set, config, root)
end
