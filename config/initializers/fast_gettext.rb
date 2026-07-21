FastGettext.add_text_domain "app", path: "locale", type: :po, ignore_fuzzy: true

# "en" needs no locale/en/app.po file, so it is added explicitly here.
FastGettext.default_available_locales =
  ([ "en" ] + Dir.glob(Rails.root.join("locale", "*/")).map { |dir| File.basename(dir) }).uniq
FastGettext.default_text_domain = "app"

# Keep source locations (#: file:line) in the extracted .pot/.po files.
Rails.application.config.gettext_i18n_rails.default_options = %w[--sort-by-msgid --no-wrap]
