# syntax = docker/dockerfile:1.2

# Make sure RUBY_VERSION matches the Ruby version in .ruby-version and Gemfile
ARG RUBY_VERSION=3.4.5
FROM registry.docker.com/library/ruby:$RUBY_VERSION-slim as base

LABEL org.opencontainers.image.description="Web container for Mapforge"
LABEL org.opencontainers.image.source="https://github.com/mapforge-org/mapforge"
LABEL org.opencontainers.image.licenses="MIT"

# Rails app lives here
WORKDIR /rails

# Set production environment
ENV RAILS_ENV="production" \
    BUNDLE_DEPLOYMENT="1" \
    BUNDLE_PATH="/usr/local/bundle" \
    BUNDLE_WITHOUT="development"


# Throw-away build stage to reduce size of final image
FROM base as build

# Install packages needed to build gems
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y ruby-dev build-essential git npm libvips pkg-config libproj-dev proj-bin libimlib2-dev

# Install application gems
COPY Gemfile Gemfile.lock ./
RUN bundle install && \
    rm -rf ~/.bundle/ "${BUNDLE_PATH}"/ruby/*/cache "${BUNDLE_PATH}"/ruby/*/bundler/gems/*/.git && \
    bundle exec bootsnap precompile --gemfile

# Install JavaScript dependencies
COPY package.json package-lock.json ./
RUN npm install --omit=dev

# Copy application code
COPY . .

# Precompile bootsnap code for faster boot times
RUN bundle exec bootsnap precompile app/ lib/

# Precompiling assets for production without requiring secret RAILS_MASTER_KEY
RUN SECRET_KEY_BASE_DUMMY=1 ./bin/rails assets:precompile


# Final stage for app image
FROM base

# Install packages needed for deployment
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y libjemalloc2 vim less curl iputils-ping libsqlite3-0 libvips proj-bin wget gnupg ca-certificates imagemagick libimlib2 && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Install chrome for screenshots (adds 400MB :-o)
# Add Google's public key
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
# Write a list of Google Chrome's dependencies to a file
RUN echo 'deb http://dl.google.com/linux/chrome/deb/ stable main' > /etc/apt/sources.list.d/google-chrome.list
# Update packages again and install Google Chrome
RUN apt-get update -qq && apt-get install --no-install-recommends -y google-chrome-stable fonts-noto-color-emoji

# Copy built artifacts: gems, application
COPY --from=build /usr/local/bundle /usr/local/bundle
COPY --from=build /rails /rails

# Run and own only the runtime files as a non-root user for security
RUN useradd rails --create-home --shell /bin/bash && \
    chown -R rails:rails db log storage tmp
USER rails:rails

# Entrypoint prepares the database.
ENTRYPOINT ["/rails/bin/docker-entrypoint"]

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD ["./bin/thrust", "rails", "server"]
