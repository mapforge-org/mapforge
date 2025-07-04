# https://github.com/yhirose/maxminddb
begin
  MAXMIND_DB = MaxMindDB.new("./db/GeoLite2-City.mmdb")
rescue => e
  Rails.logger.error "Cannot open MaxMind IP database: #{e.message}"
  Rails.logger.error "See README for instructions on how to set it up"
end
