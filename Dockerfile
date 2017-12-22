# SendGrid-Proxy Dockerfile

FROM mhart/alpine-node
RUN mkdir /src

COPY . /app
WORKDIR /app
RUN yarn

EXPOSE 8888

CMD ["yarn", "start"]