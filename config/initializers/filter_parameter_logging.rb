# Be sure to restart your server when you modify this file.

# Configure parameters to be partially matched (e.g. passw matches password) and filtered from the log file.
# Use this to limit dissemination of sensitive information.
# See the ActiveSupport::ParameterFilter documentation for supported notations and behaviors.
Rails.application.config.filter_parameters += [
  :passw, :email, :secret, :token, :_key, :crypt, :salt, :certificate, :otp, :ssn, :cvv, :cvc
]

Rails.application.config.x.catch_map_assets = %w[
  swimming_pool bollard office gate recycling
  bicycle_parking reservoir sports_centre basin atm lift_gate
  cycle_barrier running brownfield water_park equestrian theme_park
  athletics motorcycle_parking yoga table_tennis cycling chess billiards canoe
  rowing multi hackerspace ferry_terminal
]
