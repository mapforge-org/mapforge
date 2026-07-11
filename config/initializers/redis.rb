# Fail application boot if redis is not available (used by Action Cable)
cable_config = Rails.application.config_for(:cable)

if cable_config[:adapter].to_s == "redis" && !ENV["SECRET_KEY_BASE_DUMMY"]
  begin
    redis = Redis.new(url: cable_config[:url], timeout: 1)
    redis.ping
  rescue Redis::BaseConnectionError => e
    puts "Could not connect to Redis. #{e.message}"
    exit 1
  ensure
    redis&.close
  end
end
