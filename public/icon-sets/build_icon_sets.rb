#!/usr/bin/env ruby
# Builds the icon sets under public/icon-sets from their npm packages.
#
# MapLibre cannot load an SVG into 'icon-image', so every icon is rasterized to a PNG of the
# same size as the emojis in public/icon-sets/noto. The output is committed, this script only
# runs when a set gets added or updated. See public/icon-sets/README.
#
# Usage: ruby public/icon-sets/build_icon_sets.rb [set ...]   (default: all sets)

require "fileutils"
require "json"
require "tmpdir"

SIZE = 72

EMOJI_DATA = "public/icon-sets/noto/emoji-mart-data.json"

SETS = {
  "pinhead" => {
    package: "@waysidemapping/pinhead",
    name: "Pinhead",
    icon: "map_pin_with_dot",
    dir: "dist/icons",
    # changelog.json names the icon of every source set that a pinhead icon replaces, and
    # those names become extra search keywords, see aliases
    aliases: "dist/changelog.json",
    sources: "dist/external_sources.json"
  },
  "fontawesome" => {
    package: "@fortawesome/fontawesome-free",
    name: "Font Awesome",
    icon: "location-dot",
    # the free package also has regular (thin) and brands (colored logos) styles, see README
    dir: "svgs/solid"
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
def index(set, config, ids, keywords)
  {
    id: set,
    name: config[:name],
    icon: { src: "/icon-sets/#{set}/#{config[:icon]}.png" },
    emojis: ids.sort.map do |id|
      {
        id: "#{set}-#{id}",
        name: humanize(id),
        keywords: (id.split(/[-_]/) + keywords.fetch(id, [])).uniq,
        skins: [ { src: "/icon-sets/#{set}/#{id}.png" } ]
      }
    end
  }
end

# Pinhead redrew the icons of maki, temaki and eleven more sets, and it renamed most of them:
# maki 'cafe' is pinhead 'cup_and_saucer'. changelog.json records the source name per icon,
# and those are the names our users know, so they become search keywords. A later release can
# rename an icon, which it records as oldId and newId, so the chain is followed to the id that
# still exists.
def aliases(package, config, ids)
  changes = JSON.parse(File.read(File.join(package, config[:aliases])))
    .flat_map { |release| release["iconChanges"] }
  renamed = changes.filter_map { |c| [ c["oldId"], c["newId"] ] if c["oldId"] && c["newId"] }.to_h
  sources = JSON.parse(File.read(File.join(package, config[:sources]))).map { |s| s["id"] }
  known = ids.to_set

  changes.each_with_object({}) do |change, keywords|
    id = resolve(change["newId"], renamed, known) or next
    # a source name can be an OSM tag, 'tourism/hostel' gives the keywords 'tourism' and 'hostel'
    names = sources.flat_map { |source| Array(change[source]) }.grep(String)
    (keywords[id] ||= []).concat(names.flat_map { |name| name.split(%r{[-_/]}) })
  end
end

def resolve(id, renamed, known)
  seen = Set.new
  while id && !known.include?(id) && renamed.key?(id) && seen.add?(id)
    id = renamed[id]
  end
  id if known.include?(id)
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
    ids = rasterize(File.join(package, config[:dir] || "icons"), target)
    keywords = config[:aliases] ? aliases(package, config, ids) : {}
    File.write(File.join(target, "index.json"), JSON.generate(index(set, config, ids, keywords)))
    puts "#{set}: #{ids.size} icons"
  end
end

root = File.expand_path("../..", __dir__)
sets = ARGV.empty? ? SETS.keys : ARGV
sets.each do |set|
  config = SETS[set] or abort("unknown icon set '#{set}', known: #{SETS.keys.join(", ")}")
  build(set, config, root)
end
